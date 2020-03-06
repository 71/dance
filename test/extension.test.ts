import * as assert from 'assert'

suite('Dummy Tests', () => {
  test('Dummy', () => {
    assert.equal(-1, [1, 2, 3].indexOf(5))
    assert.equal(-1, [1, 2, 3].indexOf(0))
  })
})
