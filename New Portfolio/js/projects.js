const projects = [
  {
    name: "Gamecraft",
    year: "2025",
    schoolYear: "First year",
    description:
      "A game hosting site for a fictional game development company.",
    stack: ["HTML", "CSS", "JavaScript"],
    theme: "light",
    image: "../images/Gamecraft.png",
    link: "https://604915.klas4s25.ictcollege-amersfoort.nl/Gamecraft/",
  },
  {
    name: "Het Goede Doel",
    year: "2025",
    schoolYear: "First year",
    description:
      "A website for a charity, This was my first project using HTML and CSS. So dont judge it too harshly.",
    stack: ["HTML", "CSS"],
    theme: "teal",
    image: "../images/goededoel.png",
    link: "https://604915.klas4s25.ictcollege-amersfoort.nl/goededoel/",
  },
  {
    name: "Rythm+",
    year: "2025",
    schoolYear: "First year",
    description:
      "Here i made a rythm game using purely frontend code. I might improve this soon.",
    stack: ["HTML", "CSS", "JavaScript"],
    theme: "navy",
    image: "../images/game.png",
    link: "https://604915.klas4s25.ictcollege-amersfoort.nl/Game/",
  },
  {
    name: "Gastenboek",
    year: "2026",
    schoolYear: "First year",
    description:
      "My introduction to crud systems and databases. Made with normal php and mysql.",
    stack: ["HTML", "CSS", "PHP", "MySQL"],
    theme: "white",
    image: "../images/gastenboek.png",
    link: "https://604915.klas4s25.ictcollege-amersfoort.nl/gastenboek/gastenboek/",
  },
  {
    name: "Ergowijzer",
    year: "2026",
    schoolYear: "First year",
    description:
      "A regular website about erganomics for a fictional company.",
    stack: ["HTML", "CSS", "JavaScript"],
    theme: "light",
    image: "../images/ergo.png",
    link: "https://604915.klas4s25.ictcollege-amersfoort.nl/Ergowijzer/",
  },
  {
    name: "Event Site",
    category: "Development",
    year: "2026",
    schoolYear: "First year",
    description:
      "My introduction to OOP programming. made using PHP.",
    stack: ["HTML", "CSS", "JavaScript", "PHP", "MySQL"],
    theme: "teal",
    image: "../images/logo.png",
    link: "https://604915.klas4s25.ictcollege-amersfoort.nl/Event/public/",
  },
  {
    name: "Portfolio",
    year: "2026",
    schoolYear: "Second year",
    description:
      "This is a site Im constantly uploading to show my progress, as you can see it already looks way better then all my other stuff.",
    stack: ["HTML", "CSS", "JavaScript", "C#"],
    theme: "white",
    image: "../images/logo.png",
    link: "https://604915.klas4s25.ictcollege-amersfoort.nl/",
  },
]

const projectList = document.querySelector("#project-list")

function projectCard(project) {
  return `
    <article class="project-card project-card-full">
      <div class="project-visual ${project.theme}">
        <div class="project-logo">
          <img class="project-image" src="${project.image}" alt="${project.name}" />
        </div>
        <strong class="project-visual-name">${project.name}</strong>
      </div>
      <div class="project-info">
        <p class="project-meta">${project.year}</p>
        <h3 class="project-name">${project.name}</h3>
        <p class="project-description">${project.description}</p>
        <div class="project-tags">
          ${project.stack.map((item) => `<span>${item}</span>`).join("")}
        </div>
        <a href="${project.link}" target="_blank" rel="noreferrer">Open project <span>↗</span></a>
      </div>
    </article>
  `
}

function renderProjects(filter = "All") {
  projectList.innerHTML = projects
    .filter(
      (project) =>
        filter === "All" ||
        project.stack.includes(filter) ||
        project.schoolYear === filter,
    )
    .map(projectCard)
    .join("")
}

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".filter")
      .forEach((item) => item.classList.remove("active"))
    button.classList.add("active")
    renderProjects(button.dataset.filter)
  })
})

renderProjects()
