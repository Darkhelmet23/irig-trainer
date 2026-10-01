function unwrap(result) {
  if (result.error) throw result.error;
  return result.data;
}

export function createCloudRepositories(client, userId) {
  async function rows(table, columns) {
    const all = [];
    for (let offset = 0; ; offset += 1000) {
      const part = unwrap(await client.from(table).select(columns).eq("user_id", userId)
        .range(offset, offset + 999));
      all.push(...(part || []));
      if (!part || part.length < 1000) return all;
    }
  }
  return {
    async read() {
      const [profiles, skills, sessions, settings, projects] = await Promise.all([
        rows("profiles", "user_id,profile_json,updated_at"),
        rows("skill_progress", "skill_id,xp"),
        rows("practice_sessions", "id,lesson_id,accuracy,bpm,speed,created_at,session_json"),
        rows("user_settings", "settings_json,updated_at,revision"),
        rows("song_projects", "id,project_json,revision,updated_at"),
      ]);
      return { profile: profiles[0] || null, skills, sessions,
        settings: settings[0] || null, projects };
    },
    async skill(skillId, xp) {
      return unwrap(await client.rpc("sync_skill_xp", {
        p_user_id: userId, p_skill_id: skillId, p_xp: xp,
      }));
    },
    async profile(profileJson) {
      return unwrap(await client.rpc("sync_live_profile", {
        p_user_id: userId, p_profile: profileJson,
      }));
    },
    async session(item) {
      return unwrap(await client.from("practice_sessions").upsert({
        id: item.id, user_id: userId, lesson_id: item.lessonId || item.title || "practice",
        accuracy: item.accuracy, bpm: item.bpm > 0 ? item.bpm : null,
        speed: item.speed > 0 && item.speed <= 2 ? item.speed : null,
        created_at: new Date(item.at || Date.now()).toISOString(), session_json: item,
      }, { onConflict: "user_id,id", ignoreDuplicates: true }));
    },
    async settings(value, updatedAt) {
      return unwrap(await client.rpc("sync_user_settings", {
        p_user_id: userId, p_settings: { practice: value }, p_updated_at: updatedAt,
      }));
    },
    async project(project) {
      const cloudCopy = { ...project, recordings: [], versions: (project.versions || []).map((version) => ({
        ...version, snapshot: version.snapshot ? { ...version.snapshot, recordings: [] } : version.snapshot,
      })) };
      return unwrap(await client.rpc("sync_song_project", {
        p_user_id: userId, p_id: project.id, p_project: cloudCopy,
        p_modified_at: project.modifiedAt,
      }));
    },
  };
}
