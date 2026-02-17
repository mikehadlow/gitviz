const app = document.getElementById("app")!;

try {
  const res = await fetch("/api/data");
  if (!res.ok) {
    app.textContent = `Error: server returned ${res.status}`;
    throw new Error(`fetch failed: ${res.status}`);
  }
  const data = await res.json();
  console.log("RepoData:", data);

  const h1 = document.createElement("h1");
  h1.textContent = data.repoName;
  const p = document.createElement("p");
  p.textContent = `${data.authors.length} author(s)`;
  app.replaceChildren(h1, p);
} catch (err) {
  console.error("Failed to load repo data:", err);
  if (!app.textContent) {
    app.textContent = "Failed to load repository data.";
  }
}
