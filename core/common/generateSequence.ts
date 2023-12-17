function getRandomIntInclusive(min: number, max: number) {
	min = Math.ceil(min)
	max = Math.floor(max)
	return Math.floor(Math.random() * (max - min + 1)) + min
}

const generateSequence = () => parseInt(`${Date.now().valueOf()}${getRandomIntInclusive(0, 10000)}`, 10)

export default generateSequence