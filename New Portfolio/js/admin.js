const $ = (selector) => document.querySelector(selector);
const login = $("#login-form");
const admin = $("#admin");
const status = $("#status");

const formData = (form) => Object.fromEntries(new FormData(form));
const post = (body) => ({ method: "POST", body: JSON.stringify(body) });

// Create an element: el("td", { textContent: "x" }, child1, child2)
const el = (tag, props, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

async function request(path, options = {}) {
  const headers =
    options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" };
  const response = await fetch(path, { ...options, headers });
  if (!response.ok)
    throw new Error("Request failed. Check the database and try again.");
  return response.status === 204 ? null : response.json();
}

// Run a task; show its error (or an optional success message) in the status line.
async function run(task, success) {
  try {
    await task();
    if (success) status.textContent = success;
  } catch (error) {
    status.textContent = error.message;
  }
}

const deleteButton = (url) =>
  el("button", {
    textContent: "Delete",
    onclick: () =>
      run(async () => {
        await request(url, { method: "DELETE" });
        await refresh();
      }),
  });

const isSafeLink = (link = "") =>
  /^https?:\/\//i.test(link) || link === "index.html";

async function refresh() {
  const [projects, skills] = await Promise.all([
    request("/api/projects"),
    request("/api/skills"),
  ]);

  $("#projects").replaceChildren(
    ...projects.map((project) =>
      el(
        "tr",
        {},
        el("td", { textContent: `${project.name} (${project.year})` }),
        el(
          "td",
          {},
          isSafeLink(project.link || "")
            ? el("a", {
                href: project.link,
                target: "_blank",
                rel: "noreferrer",
                textContent: project.link,
              })
            : "—",
        ),
        el("td", {}, deleteButton(`/api/projects/${project.id}`)),
      ),
    ),
  );

  $("#skills").replaceChildren(
    ...skills.map((skill) =>
      el(
        "li",
        {},
        el("span", { textContent: skill.name }),
        deleteButton(`/api/skills/${skill.id}`),
      ),
    ),
  );
}

// Handle a form: run the task, then reset the form and reload the lists.
function onSubmit(form, success, task) {
  form.onsubmit = (event) => {
    event.preventDefault();
    run(async () => {
      await task(form);
      form.reset();
      await refresh();
    }, success);
  };
}

login.onsubmit = async (event) => {
  event.preventDefault();
  try {
    await request("/api/auth/login", post(formData(login)));
    login.hidden = true;
    admin.hidden = false;
    await refresh();
  } catch {
    $("#login-status").textContent = "Sign-in failed.";
  }
};

$("#logout").onclick = async () => {
  await request("/api/auth/logout", { method: "POST" });
  admin.hidden = true;
  login.hidden = false;
};

onSubmit($("#project-form"), "Project added.", async (form) => {
  const data = formData(form);
  const file = form.elements.image.files[0];
  let image = "";

  if (file) {
    const upload = new FormData();
    upload.append("image", file);
    ({ image } = await request("/api/uploads/project-image", {
      method: "POST",
      body: upload,
    }));
  }

  await request(
    "/api/projects",
    post({
      name: data.name,
      year: Number(data.year),
      description: data.description,
      stack: data.stack
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      schoolYear: data.schoolYear,
      theme: "light",
      image,
      link: data.link,
    }),
  );
});

onSubmit($("#skill-form"), "Skill added.", (form) =>
  request("/api/skills", post({ name: formData(form).name, category: "General" })),
);