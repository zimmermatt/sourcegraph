import * as sourcegraph from 'sourcegraph'
import { isDefined } from '../../../../shared/src/util/types'
import { combineLatestOrDefault } from '../../../../shared/src/util/rxjs/combineLatestOrDefault'
import { flatten } from 'lodash'
import { Subscription, Observable, of, Unsubscribable, from } from 'rxjs'
import { map, switchMap, startWith, first, toArray } from 'rxjs/operators'
import { queryGraphQL } from './util'
import * as GQL from '../../../../shared/src/graphql/schema'

export function registerDemo0(): Unsubscribable {
    const subscriptions = new Subscription()
    subscriptions.add(startDiagnostics())
    subscriptions.add(sourcegraph.languages.registerCodeActionProvider(['*'], createCodeActionProvider()))
    return subscriptions
}

const mods = [{ binding: 'React', module: 'react' }, { binding: 'H', module: 'history' }]

function startDiagnostics(): Unsubscribable {
    const subscriptions = new Subscription()

    const diagnosticsCollection = sourcegraph.languages.createDiagnosticCollection('demo0')
    subscriptions.add(diagnosticsCollection)
    subscriptions.add(
        from(sourcegraph.workspace.rootChanges)
            .pipe(
                startWith(void 0),
                map(() => sourcegraph.workspace.roots),
                switchMap(async () => {
                    const results = flatten(
                        await from(
                            sourcegraph.search.findTextInFiles(
                                { pattern: 'import \\* as (React|H)', type: 'regexp' },
                                {
                                    repositories: { includes: ['sourcegraph$'], type: 'regexp' },
                                    files: {
                                        includes: ['^(web/src/org|browser/src/libs/phabricator)/.*\\.tsx?$'],
                                        type: 'regexp',
                                    },
                                    maxResults: 5,
                                }
                            )
                        )
                            .pipe(toArray())
                            .toPromise()
                    )
                    return combineLatestOrDefault(
                        results.map(async ({ uri }) => {
                            const { text } = await sourcegraph.workspace.openTextDocument(new URL(uri))
                            const diagnostics: sourcegraph.Diagnostic[] = flatten(
                                mods.map(({ binding, module }) =>
                                    findMatchRanges(text, binding, module).map(
                                        range =>
                                            ({
                                                message:
                                                    'Unnecessary `import * as ...` of module that has default export',
                                                range,
                                                severity: sourcegraph.DiagnosticSeverity.Information,
                                                code: JSON.stringify({ binding, module }),
                                            } as sourcegraph.Diagnostic)
                                    )
                                )
                            )
                            return [new URL(uri), diagnostics] as [URL, sourcegraph.Diagnostic[]]
                        })
                    ).pipe(map(items => items.filter(isDefined))) // .pipe(switchMap(results => flatten<[URL, sourcegraph.Diagnostic[]]>(results)))
                }),
                switchMap(results => results)
            )
            .subscribe(entries => {
                diagnosticsCollection.set(entries)
            })
    )

    return diagnosticsCollection
}

function createCodeActionProvider(): sourcegraph.CodeActionProvider {
    return {
        provideCodeActions: async (doc, _rangeOrSelection, context): Promise<sourcegraph.CodeAction[]> => {
            if (context.diagnostics.length === 0) {
                return []
            }

            const fixEdits = new sourcegraph.WorkspaceEdit()
            for (const diag of context.diagnostics) {
                const { binding, module } = JSON.parse(diag.code as string)
                for (const range of findMatchRanges(doc.text, binding, module)) {
                    fixEdits.replace(new URL(doc.uri), range, `import ${binding} from '${module}'`)
                }
            }

            const disableRuleEdits = new sourcegraph.WorkspaceEdit()
            for (const diag of context.diagnostics) {
                const { binding, module } = JSON.parse(diag.code as string)
                for (const range of findMatchRanges(doc.text, binding, module)) {
                    disableRuleEdits.insert(
                        new URL(doc.uri),
                        range.end,
                        ' // sourcegraph:ignore-line React lint https://sourcegraph.example.com/ofYRz6NFzj'
                    )
                }
            }

            // for (const [uri, diags] of sourcegraph.languages.getDiagnostics()) {
            //     const doc = await sourcegraph.workspace.openTextDocument(uri)
            //     for (const range of findMatchRanges(doc.text)) {
            //         workspaceEdit.replace(new URL(doc.uri), range, "import React from 'react'")
            //     }
            // }
            return [
                {
                    title: 'Convert to named import',
                    edit: fixEdits,
                    diagnostics: flatten(
                        sourcegraph.languages.getDiagnostics().map(([uri, diagnostics]) => diagnostics)
                    ),
                },
                {
                    title: 'Ignore',
                    edit: disableRuleEdits,
                    diagnostics: flatten(
                        sourcegraph.languages.getDiagnostics().map(([uri, diagnostics]) => diagnostics)
                    ),
                },
                {
                    title: 'Open tsconfig.json',
                    command: {
                        title: '',
                        command: 'open',
                        arguments: [
                            'http://localhost:3080/github.com/sourcegraph/sourcegraph/-/blob/web/tsconfig.json',
                        ],
                    },
                },
                {
                    title: 'Start discussion thread',
                    command: { title: '', command: 'TODO!(sqs)' },
                },
                {
                    title: 'Message code owner: @tsenart',
                    command: { title: '', command: 'TODO!(sqs)' },
                },
                {
                    title: `View npm package: ${JSON.parse(context.diagnostics[0].code as string).module}`,
                    command: { title: '', command: 'TODO!(sqs)' },
                },
            ]
        },
    }
}

function findMatchRanges(text: string, binding: string, module: string): sourcegraph.Range[] {
    const ranges: sourcegraph.Range[] = []
    for (const [i, line] of text.split('\n').entries()) {
        const pat = new RegExp(`^import \\* as ${binding} from '${module}'$`, 'g')
        for (let match = pat.exec(line); !!match; match = pat.exec(line)) {
            ranges.push(new sourcegraph.Range(i, match.index, i, match.index + match[0].length))
        }
    }
    return ranges
}
