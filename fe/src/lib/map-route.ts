export function travelledCoordinates(route: number[][], point: number[]): number[][] {
  let bestDistance = Infinity,
    segment = 0,
    projected: number[] | undefined
  for (let index = 0; index < route.length - 1; index++) {
    const start = route[index],
      end = route[index + 1]
    const dx = end[0] - start[0],
      dy = end[1] - start[1]
    const length = dx * dx + dy * dy
    const progress = length
      ? Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / length))
      : 0
    const candidate = [start[0] + dx * progress, start[1] + dy * progress]
    const distance = (point[0] - candidate[0]) ** 2 + (point[1] - candidate[1]) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      segment = index
      projected = candidate
    }
  }
  return projected ? [...route.slice(0, segment + 1), projected] : []
}
