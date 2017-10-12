import 'rxjs/add/operator/map'
import { Observable } from 'rxjs/Observable'
import { queryGraphQL } from '../backend/graphql'
import { AbsoluteRepoFilePosition, makeRepoURI } from '../repo'
import { memoizeObservable } from '../util/memoize'

export const fetchBlameFile = memoizeObservable((ctx: AbsoluteRepoFilePosition): Observable<GQL.IHunk[] | null> =>
    queryGraphQL(`
        query BlameFile($repoPath: String, $commitID: String, $filePath: String, $startLine: Int, $endLine: Int) {
            root {
                repository(uri: $repoPath) {
                    commit(rev: $commitID) {
                        commit {
                            file(path: $filePath) {
                                blame(startLine: $startLine, endLine: $endLine) {
                                    startLine
                                    endLine
                                    startByte
                                    endByte
                                    rev
                                    author {
                                        person {
                                            name
                                            email
                                            gravatarHash
                                        }
                                        date
                                    }
                                    message
                                }
                            }
                        }
                    }
                }
            }
        }
    `, { repoPath: ctx.repoPath, commitID: ctx.commitID, filePath: ctx.filePath, startLine: ctx.position.line, endLine: ctx.position.line })
        .map(result => {
            if (!result.data ||
                !result.data.root ||
                !result.data.root.repository ||
                !result.data.root.repository.commit ||
                !result.data.root.repository.commit.commit ||
                !result.data.root.repository.commit.commit.file ||
                !result.data.root.repository.commit.commit.file.blame) {
                console.error('unexpected BlameFile response:', result)
                return null
            }
            return result.data.root.repository.commit.commit.file.blame
        }),
    makeRepoURI
)
