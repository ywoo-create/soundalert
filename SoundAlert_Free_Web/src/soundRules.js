export const SOUND_RULES = [
  {
    keywords: ["vehicle horn", "car horn", "honking", "toot"],
    situation: "vehicle_horn",
    displayName: "차량 경적",
    baseDanger: 85,
    action: "주변 차량의 위치를 확인하고 도로 가장자리에서 벗어나세요.",
    icon: "car",
  },
  {
    keywords: ["air horn", "truck horn"],
    situation: "truck_horn",
    displayName: "대형 차량 경적",
    baseDanger: 90,
    action: "대형 차량이 접근할 수 있습니다. 즉시 주변을 확인하고 안전한 곳으로 이동하세요.",
    icon: "car",
  },
  {
    keywords: ["siren", "emergency vehicle", "police car", "ambulance", "fire engine", "fire truck"],
    situation: "emergency_vehicle",
    displayName: "긴급 차량 사이렌",
    baseDanger: 90,
    action: "긴급 차량이 접근할 수 있습니다. 이동 경로를 확인하고 안전한 위치를 확보하세요.",
    icon: "siren",
  },
  {
    keywords: ["fire alarm", "smoke detector", "smoke alarm"],
    situation: "fire_alarm",
    displayName: "화재 경보",
    baseDanger: 100,
    action: "화재 가능성이 있습니다. 주변을 확인하고 필요하면 즉시 대피하세요.",
    icon: "fire",
  },
  {
    keywords: ["baby cry", "infant cry"],
    situation: "baby_cry",
    displayName: "아기 울음",
    baseDanger: 45,
    action: "주변의 아기 상태를 확인하세요.",
    icon: "baby",
  },
  {
    keywords: ["doorbell", "ding-dong", "door bell"],
    situation: "doorbell",
    displayName: "초인종",
    baseDanger: 20,
    action: "방문자가 있는지 현관을 확인하세요.",
    icon: "bell",
  },
  {
    keywords: ["microwave", "beep, bleep", "beep", "bleep"],
    situation: "appliance_alert",
    displayName: "전자기기 알림음",
    baseDanger: 25,
    action: "전자레인지 등 주변 전자기기의 완료 알림인지 확인하세요.",
    icon: "bell",
  },
  {
    keywords: ["ringtone", "telephone bell", "telephone ringing", "alarm clock", "alarm"],
    situation: "phone_alert",
    displayName: "생활 알림음",
    baseDanger: 30,
    action: "휴대전화 또는 주변 기기의 알림 내용을 확인하세요.",
    icon: "bell",
  },
  {
    keywords: ["explosion"],
    situation: "explosion",
    displayName: "폭발음",
    baseDanger: 100,
    action: "즉시 위험 장소에서 벗어나 주변 상황을 확인하세요.",
    icon: "warning",
  },
  {
    keywords: ["glass", "shatter", "breaking"],
    situation: "glass_breaking",
    displayName: "유리 파손",
    baseDanger: 80,
    action: "깨진 유리에 접근하지 말고 주변 사고 상황을 확인하세요.",
    icon: "warning",
  },
];

export function findSoundRule(label = "") {
  const normalized = label.toLowerCase();
  return SOUND_RULES.find(rule =>
    rule.keywords.some(keyword => normalized.includes(keyword.toLowerCase()))
  );
}

export function dangerLevel(score) {
  if (score >= 80) return { level: 4, color: "red", label: "위험" };
  if (score >= 60) return { level: 3, color: "orange", label: "주의" };
  if (score >= 30) return { level: 2, color: "yellow", label: "관심" };
  return { level: 1, color: "green", label: "안전" };
}
