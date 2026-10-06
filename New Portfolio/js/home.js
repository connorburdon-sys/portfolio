const hobbies = [
  {
    name: "Gaming",
    text: "I love video games, currently im loving metroidvanias. my favorite game of all time will always be terarria though.",
  },
  {
    name: "Music",
    text: "I love music, I play drums every day and I listen to it 24/7. I even collect CDs.",
  },
  {
    name: "Drumming",
    text: "I love playing drums. Ive been playing for 3 years now and i still suck but its still really cool to see the little improvements i do make. Also its great stress relief.",
  },
  {
    name: "Coding",
    text: "Its kind of obvious that I like coding but yeah, I wouldn't do something I hate for a living",
  },
]

let activeHobby = 0
const cd = document.querySelector("#cd")
const title = document.querySelector("#cd-title")
const description = document.querySelector("#hobby-description")
const progress = document.querySelector("#hobby-progress")

function updateHobby() {
  const hobby = hobbies[activeHobby]
  title.innerHTML = `
    <span>${String(activeHobby + 1).padStart(2, "0")} / 04</span>
    <strong>${hobby.name}</strong>
  `
  description.textContent = hobby.text
  cd.style.transform = `rotate(${activeHobby * 90}deg)`
  progress.innerHTML = hobbies
    .map(
      (_, index) =>
        `<span class="${index === activeHobby ? "active" : ""}"></span>`,
    )
    .join("")

  title.classList.remove("animate")
  description.classList.remove("animate")
  void title.offsetWidth
  title.classList.add("animate")
  description.classList.add("animate")
}

document.querySelector("#previous-hobby").addEventListener("click", () => {
  activeHobby = (activeHobby - 1 + hobbies.length) % hobbies.length
  updateHobby()
})

document.querySelector("#next-hobby").addEventListener("click", () => {
  activeHobby = (activeHobby + 1) % hobbies.length
  updateHobby()
})

updateHobby()
