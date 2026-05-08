export function countLabel(count: number, unit: string) {
  return `${count} ${unit}`;
}

export function durationLabel(durationMs: number) {
  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${seconds} 秒`;
  }

  if (remainingSeconds === 0) {
    return `${minutes} 分钟`;
  }

  return `${minutes} 分 ${remainingSeconds} 秒`;
}

export function byteLengthLabel(byteLength: number) {
  if (byteLength < 1024) {
    return `${byteLength} 字节`;
  }

  if (byteLength < 1024 * 1024) {
    return `${Math.round(byteLength / 1024)} KB`;
  }

  return `${Math.round(byteLength / (1024 * 1024))} MB`;
}
