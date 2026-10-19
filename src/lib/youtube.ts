export const extractYouTubeId = (url: string): { videoId: string; startTime?: number } | null => {
  if (!url) return null;
  const trimmed = url.trim();

  // Parse start time if present (e.g. t=80s, t=1m20s, start=80)
  let startTime: number | undefined;
  const timeMatch = trimmed.match(/[?&](?:t|start)=([0-9hms]+)/i);
  if (timeMatch) {
    const rawTime = timeMatch[1].toLowerCase();
    if (/^\d+$/.test(rawTime)) {
      startTime = parseInt(rawTime, 10);
    } else {
      let seconds = 0;
      const hours = rawTime.match(/(\d+)h/);
      const minutes = rawTime.match(/(\d+)m/);
      const secs = rawTime.match(/(\d+)s/);
      if (hours) seconds += parseInt(hours[1], 10) * 3600;
      if (minutes) seconds += parseInt(minutes[1], 10) * 60;
      if (secs) seconds += parseInt(secs[1], 10);
      if (seconds > 0) startTime = seconds;
    }
  }

  // 1. youtu.be/<id>
  const shortMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (shortMatch) return { videoId: shortMatch[1], startTime };

  // 2. youtube.com/watch?v=<id>
  const watchMatch = trimmed.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?youtube\.com\/watch\?(?:[^&]+&)*v=([a-zA-Z0-9_-]{11})/i);
  if (watchMatch) return { videoId: watchMatch[1], startTime };

  // 3. youtube.com/embed/<id>
  const embedMatch = trimmed.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
  if (embedMatch) return { videoId: embedMatch[1], startTime };

  // 4. youtube.com/shorts/<id>
  const shortsMatch = trimmed.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
  if (shortsMatch) return { videoId: shortsMatch[1], startTime };

  // 5. Bare 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { videoId: trimmed, startTime };
  }

  return null;
};
