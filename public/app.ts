const app = document.getElementById("app")!;

const res = await fetch("/api/data");
const data = await res.json();
console.log("RepoData:", data);

app.innerHTML = `<h1>${data.repoName}</h1><p>${data.authors.length} author(s)</p>`;
