// How GroupCard writes a group's default ratio (DESIGN.md): "even split" when
// every member has the same weight, otherwise whole percents in the members'
// order, such as "60/40 default" for weights 3 and 2. The percents are rounded
// by largest remainder, so they always add up to 100. Weights are at least 1,
// so nobody is shown as 0%: a part that rounds to 0 becomes 1, taken from the
// largest part. A group has at most 12 members, so the largest part is always
// more than 1.
export function describeSplit(weights: readonly number[]): string {
  if (weights.every((weight) => weight === weights[0])) {
    return "even split";
  }
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const exact = weights.map((weight) => (weight * 100) / total);
  const percents = exact.map(Math.floor);
  const left = 100 - percents.reduce((sum, percent) => sum + percent, 0);
  exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .slice(0, left)
    .forEach(({ index }) => {
      percents[index] += 1;
    });
  percents.forEach((percent, index) => {
    if (percent === 0) {
      percents[index] = 1;
      percents[percents.indexOf(Math.max(...percents))] -= 1;
    }
  });
  return `${percents.join("/")} default`;
}
