import generateSequence from '../core/utils/generateSequence'

describe('generateSequence', () => {
	test('should return a number', () => {
		const result = generateSequence()
		expect(typeof result).toBe('number')
	})

	test('should generate a different number each time it is called', async () => {
		const sequence1 = generateSequence()
		const sequence2 = generateSequence()
		expect(sequence1).not.toEqual(sequence2)
	})
})
