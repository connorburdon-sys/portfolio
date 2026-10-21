const projectList = document.querySelector("#project-list");
const projectsStatus = document.querySelector("#projects-status");
let projects = [];
let activeFilter = "All";
let projectsUnavailable = false;

const escapeHtml = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

function projectCard(project) {
  const image = project.image
    ? `<img class="project-image" src="${escapeHtml(project.image)}" alt="${escapeHtml(project.name)}" />`
    : "";
  const link =
    /^https?:\/\//i.test(project.link || "") || project.link === "index.html"
      ? `<a href="${escapeHtml(project.link)}" target="_blank" rel="noreferrer">Open project <span>↗</span></a>`
      : "";
  return `
    <article class="project-card project-card-full">
      <div class="project-visual ${escapeHtml(project.theme || "light")}">
        <div class="project-logo">${image}</div>
        <strong class="project-visual-name">${escapeHtml(project.name)}</strong>
      </div>
      <div class="project-info">
        <p class="project-meta">${escapeHtml(project.year)}${project.schoolYear ? ` · ${escapeHtml(project.schoolYear)}` : ""}</p>
        <h3 class="project-name">${escapeHtml(project.name)}</h3>
        <p class="project-description">${escapeHtml(project.description)}</p>
        <div class="project-tags">${(project.stack || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
        ${link}
      </div>
    </article>
  `;
}

function renderProjects() {
  const visible = projects.filter(
    (project) =>
      activeFilter === "All" ||
      (project.stack || []).includes(activeFilter) ||
      project.schoolYear === activeFilter,
  );
  projectList.innerHTML = visible.map(projectCard).join("");
  if (projectsUnavailable)
    projectsStatus.textContent = "Projects are temporarily unavailable.";
  else if (!projects.length)
    projectsStatus.textContent = "No projects added yet.";
  else
    projectsStatus.textContent = visible.length
      ? ""
      : "No projects match this filter.";
}

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".filter")
      .forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeFilter = button.dataset.filter;
    renderProjects();
  });
});

try {
  const response = await fetch("/api/projects");
  if (!response.ok) throw new Error();
  projects = await response.json();
} catch {
  projectsUnavailable = true;
}
renderProjects();

try {
  const response = await fetch("/api/skills");
  if (!response.ok) throw new Error();
  const skillList = document.querySelector("#skill-list");
  const skills = await response.json();
  skillList.innerHTML = skills
    .map(
      (skill) =>
        `<span title="${escapeHtml(skill.proficiency)}">${escapeHtml(skill.name)}</span>`,
    )
    .join("");
} catch {
  document.querySelector("#skill-list").textContent =
    "Skills are temporarily unavailable.";
}
