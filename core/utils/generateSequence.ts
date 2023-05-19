export function getRandomIntInclusive(min: number, max: number) {
	const intMin = Math.ceil(min)
	const intMax = Math.floor(max)
	return Math.floor(Math.random() * (intMax -  intMin + 1)) + intMin
}
  
const generateSequence = () => parseInt(`${Date.now().valueOf()}${getRandomIntInclusive(0, 10000)}`, 10)

export default generateSequence