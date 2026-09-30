function hasProfileProgress(profile) {
  return !!profile &&
    ((Number(profile.xp) || 0) > 0 ||
      (Number(profile.sessions) || 0) > 0 ||
      (profile.history?.length || 0) > 0 ||
      Object.values(profile.skillXP || {}).some((xp) => Number(xp) > 0) ||
      Object.values(profile.skills || {}).some((rank) => Number(rank) > 0));
}

export async function detectLocalProgress({
  profileStore,
  songProjects,
  loadImportedSongs,
}) {
  const demo = profileStore.loadSaved("demo");
  const live = profileStore.loadSaved("live");
  const [projects, songs] = await Promise.all([
    songProjects.listProjects().catch(() => []),
    loadImportedSongs().catch(() => []),
  ]);
  const sources = {
    demo: hasProfileProgress(demo),
    live: hasProfileProgress(live),
    projects: projects.length,
    importedSongs: songs.length,
  };
  return {
    found: sources.demo || sources.live || sources.projects > 0 ||
      sources.importedSongs > 0,
    sources,
  };
}
