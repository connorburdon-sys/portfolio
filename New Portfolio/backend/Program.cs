using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.FileProviders;
using MySqlConnector;

const string AdminUsername = "admin";
const string ProjectError = "Name, description, year, theme, image, and at least one skill are required.";
const string SkillError = "Name and category are required.";

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    WebRootPath = Path.Combine(AppContext.BaseDirectory, "wwwroot")
});

string Required(string key, string envName) =>
    builder.Configuration[key]
    ?? Environment.GetEnvironmentVariable(envName)
    ?? throw new InvalidOperationException($"Set {key} in local settings or {envName}.");

var adminPassword = Required("AdminPassword", "ADMIN_PASSWORD");
if (adminPassword.Length < 16)
    throw new InvalidOperationException("ADMIN_PASSWORD must be at least 16 characters long.");
var connectionString = Required("ConnectionStrings:Portfolio", "PORTFOLIO_DB_CONNECTION");

builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(AppContext.BaseDirectory, "keys")));
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "portfolio-admin";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.Events.OnRedirectToLogin = context => Respond(context.Response, StatusCodes.Status401Unauthorized);
        options.Events.OnRedirectToAccessDenied = context => Respond(context.Response, StatusCodes.Status403Forbidden);
    });
builder.Services.AddAuthorization();

var app = builder.Build();
var uploadDirectory = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadDirectory);

app.UsePathBase("/New Portfolio");
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadDirectory),
    RequestPath = "/uploads"
});
app.UseAuthentication();
app.UseAuthorization();

// ---------- Database helpers ----------

async Task<MySqlConnection> OpenDb(CancellationToken ct)
{
    var connection = new MySqlConnection(connectionString);
    await connection.OpenAsync(ct);
    return connection;
}

async Task<List<T>> Query<T>(string sql, Func<MySqlDataReader, T> read, CancellationToken ct)
{
    await using var connection = await OpenDb(ct);
    await using var command = new MySqlCommand(sql, connection);
    await using var reader = await command.ExecuteReaderAsync(ct);
    var rows = new List<T>();
    while (await reader.ReadAsync(ct))
        rows.Add(read(reader));
    return rows;
}

async Task<(int Rows, long Id)> Execute(string sql, CancellationToken ct, params (string Name, object? Value)[] parameters)
{
    await using var connection = await OpenDb(ct);
    await using var command = new MySqlCommand(sql, connection);
    foreach (var (name, value) in parameters)
        command.Parameters.AddWithValue(name, value);
    return (await command.ExecuteNonQueryAsync(ct), command.LastInsertedId);
}

IResult Created(string route, long id) => Results.Created($"{route}/{id}", new { id });
IResult NoContentOrNotFound(int rows) => rows == 0 ? Results.NotFound() : Results.NoContent();
IResult Invalid(string field, string message) =>
    Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

// ---------- Public endpoints ----------

app.MapGet("/api/health", async Task<IResult> (CancellationToken ct) =>
{
    try
    {
        await using var connection = await OpenDb(ct);
        await new MySqlCommand("SELECT 1", connection).ExecuteScalarAsync(ct);
        return Results.Ok(new { status = "ok", database = "connected" });
    }
    catch (MySqlException)
    {
        return Results.Json(new { status = "degraded", database = "unavailable" }, statusCode: 503);
    }
});

app.MapGet("/api/projects", async (CancellationToken ct) =>
    Results.Ok(await Query(
        "SELECT id, name, year, school_year, description, stack_json, theme, image, link FROM projects ORDER BY sort_order, id",
        ReadProject, ct)));

app.MapGet("/api/skills", async (CancellationToken ct) =>
    Results.Ok(await Query(
        "SELECT id, name, category, proficiency FROM skills ORDER BY sort_order, id",
        r => new SkillRecord(r.GetInt64("id"), r.GetString("name"), r.GetString("category"), r.GetString("proficiency")),
        ct)));

// ---------- Authentication ----------

app.MapPost("/api/auth/login", async Task<IResult> (LoginRequest request, HttpContext context) =>
{
    var expected = Encoding.UTF8.GetBytes(adminPassword);
    var provided = Encoding.UTF8.GetBytes(request.Password ?? "");
    var passwordMatches = expected.Length == provided.Length && CryptographicOperations.FixedTimeEquals(expected, provided);
    if (request.Username != AdminUsername || !passwordMatches)
        return Results.Unauthorized();

    var identity = new ClaimsIdentity([new Claim(ClaimTypes.Name, AdminUsername)], CookieAuthenticationDefaults.AuthenticationScheme);
    await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));
    return Results.Ok(new { username = AdminUsername });
});

// ---------- Admin endpoints (require login) ----------

var admin = app.MapGroup("/api").RequireAuthorization();

admin.MapPost("/auth/logout", async (HttpContext context) =>
{
    await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.NoContent();
});

admin.MapGet("/auth/me", (ClaimsPrincipal user) => Results.Ok(new { username = user.Identity?.Name }));

admin.MapPost("/uploads/project-image", async Task<IResult> (IFormFile image, HttpContext context, CancellationToken ct) =>
{
    var allowedTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png",
        [".webp"] = "image/webp", [".gif"] = "image/gif"
    };
    var extension = Path.GetExtension(image.FileName);
    if (image.Length is <= 0 or > 5_000_000 || !allowedTypes.TryGetValue(extension, out var contentType) || image.ContentType != contentType)
        return Results.BadRequest(new { error = "Choose a PNG, JPEG, WEBP, or GIF image under 5 MB." });

    var fileName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
    await using var output = File.Create(Path.Combine(uploadDirectory, fileName));
    await image.CopyToAsync(output, ct);
    return Results.Ok(new { image = $"{context.Request.PathBase}/uploads/{fileName}" });
}).DisableAntiforgery();

// Projects
admin.MapPost("/projects", async Task<IResult> (ProjectInput project, CancellationToken ct) =>
{
    if (!Valid(project)) return Invalid("project", ProjectError);
    var (_, id) = await Execute(
        "INSERT INTO projects (name, year, school_year, description, stack_json, theme, image, link, sort_order) " +
        "VALUES (@name, @year, @school_year, @description, @stack_json, @theme, @image, @link, @sort_order)",
        ct, ProjectParameters(project));
    return Created("/api/projects", id);
});

admin.MapPut("/projects/{id:long}", async Task<IResult> (long id, ProjectInput project, CancellationToken ct) =>
{
    if (!Valid(project)) return Invalid("project", ProjectError);
    var (rows, _) = await Execute(
        "UPDATE projects SET name=@name, year=@year, school_year=@school_year, description=@description, " +
        "stack_json=@stack_json, theme=@theme, image=@image, link=@link, sort_order=@sort_order WHERE id=@id",
        ct, [.. ProjectParameters(project), ("@id", id)]);
    return NoContentOrNotFound(rows);
});

admin.MapDelete("/projects/{id:long}", async Task<IResult> (long id, CancellationToken ct) =>
    NoContentOrNotFound((await Execute("DELETE FROM projects WHERE id=@id", ct, ("@id", id))).Rows));

// Skills
admin.MapPost("/skills", async Task<IResult> (SkillInput skill, CancellationToken ct) =>
{
    if (!ValidSkill(skill)) return Invalid("skill", SkillError);
    var (_, id) = await Execute(
        "INSERT INTO skills (name, category, proficiency, sort_order) VALUES (@name, @category, @proficiency, @sort_order)",
        ct, SkillParameters(skill));
    return Created("/api/skills", id);
});

admin.MapPut("/skills/{id:long}", async Task<IResult> (long id, SkillInput skill, CancellationToken ct) =>
{
    if (!ValidSkill(skill)) return Invalid("skill", SkillError);
    var (rows, _) = await Execute(
        "UPDATE skills SET name=@name, category=@category, proficiency=@proficiency, sort_order=@sort_order WHERE id=@id",
        ct, [.. SkillParameters(skill), ("@id", id)]);
    return NoContentOrNotFound(rows);
});

admin.MapDelete("/skills/{id:long}", async Task<IResult> (long id, CancellationToken ct) =>
    NoContentOrNotFound((await Execute("DELETE FROM skills WHERE id=@id", ct, ("@id", id))).Rows));

app.Run();

// ---------- Helpers ----------

static Task Respond(HttpResponse response, int statusCode)
{
    response.StatusCode = statusCode;
    return Task.CompletedTask;
}

static bool Valid(ProjectInput p) =>
    !string.IsNullOrWhiteSpace(p.Name) && p.Name.Length <= 160 &&
    !string.IsNullOrWhiteSpace(p.Description) && p.Description.Length <= 3000 &&
    p.Year is >= 1900 and <= 2200 &&
    !string.IsNullOrWhiteSpace(p.Theme) && p.Theme.Length <= 40 &&
    !string.IsNullOrWhiteSpace(p.Image) &&
    p.Stack is { Length: > 0 and <= 20 };

static bool ValidSkill(SkillInput s) =>
    !string.IsNullOrWhiteSpace(s.Name) && s.Name.Length <= 100 &&
    !string.IsNullOrWhiteSpace(s.Category) && s.Category.Length <= 100 &&
    (s.Proficiency?.Length ?? 0) <= 100;

static (string Name, object? Value)[] ProjectParameters(ProjectInput p) =>
[
    ("@name", p.Name.Trim()),
    ("@year", p.Year),
    ("@school_year", p.SchoolYear ?? ""),
    ("@description", p.Description.Trim()),
    ("@stack_json", JsonSerializer.Serialize(p.Stack)),
    ("@theme", p.Theme.Trim()),
    ("@image", p.Image ?? ""),
    ("@link", p.Link ?? ""),
    ("@sort_order", p.SortOrder)
];

static (string Name, object? Value)[] SkillParameters(SkillInput s) =>
[
    ("@name", s.Name.Trim()),
    ("@category", s.Category.Trim()),
    ("@proficiency", s.Proficiency ?? ""),
    ("@sort_order", s.SortOrder)
];

static ProjectRecord ReadProject(MySqlDataReader r) => new(
    r.GetInt64("id"), r.GetString("name"), r.GetInt32("year"), r.GetString("school_year"),
    r.GetString("description"), JsonSerializer.Deserialize<string[]>(r.GetString("stack_json")) ?? [],
    r.GetString("theme"), r.GetString("image"), r.GetString("link"));

record LoginRequest(string Username, string Password);
record ProjectInput(string Name, int Year, string? SchoolYear, string Description, string[] Stack, string Theme, string? Image, string? Link, int SortOrder = 0);
record ProjectRecord(long Id, string Name, int Year, string SchoolYear, string Description, string[] Stack, string Theme, string Image, string Link);
record SkillInput(string Name, string Category, string? Proficiency = "", int SortOrder = 0);
record SkillRecord(long Id, string Name, string Category, string Proficiency);