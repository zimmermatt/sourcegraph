import assert from 'assert'
import { mergeContext } from './FileMatchContext'

describe('components/FileMatchContext', () => {
    describe('mergeContext', () => {
        it('handles empty input', () => {
            assert.deepEqual(mergeContext(1, []), [])
        })
        it('does not merge context when there is only one line', () => {
            assert.deepEqual(mergeContext(1, [{ line: 5 }]), [[{ line: 5 }]])
        })
        it('merges overlapping context', () => {
            assert.deepEqual(mergeContext(1, [{ line: 5 }, { line: 6 }]), [[{ line: 5 }, { line: 6 }]])
        })
        it('merges adjacent context', () => {
            assert.deepEqual(mergeContext(1, [{ line: 5 }, { line: 8 }]), [[{ line: 5 }, { line: 8 }]])
        })
        it('does not merge context when far enough apart', () => {
            assert.deepEqual(mergeContext(1, [{ line: 5 }, { line: 9 }]), [[{ line: 5 }], [{ line: 9 }]])
        })
    })
})
