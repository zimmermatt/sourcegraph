import React, { useCallback } from 'react'
import { DiagnosticSeverity } from 'sourcegraph'
import { Form } from '../../../../../components/Form'
import { QueryParameterProps } from '../../../components/withQueryParameter/WithQueryParameter'
import { DiagnosticInfo } from '../item/ThreadInboxFileItem'
import { ThreadInboxSidebarFilterListDiagnosticItem } from './ThreadInboxSidebarFilterListDiagnosticItem'
import { ThreadInboxSidebarFilterListPathItem } from './ThreadInboxSidebarFilterListPathItem'

interface Props extends QueryParameterProps {
    diagnostics: DiagnosticInfo[]

    className?: string
}

/**
 * The sidebar for the thread inbox.
 */
export const ThreadInboxSidebar: React.FunctionComponent<Props> = ({
    diagnostics,
    query,
    onQueryChange,
    className = '',
}) => {
    const onChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
        e => {
            onQueryChange(e.currentTarget.value)
        },
        [onQueryChange]
    )
    const onSubmit = useCallback<React.FormEventHandler>(e => {
        e.preventDefault()
    }, [])

    const ITEM_CLASS_NAME = 'list-group-item list-group-item-action small'
    return (
        <aside className={`thread-inbox-sidebar overflow-hidden ${className}`}>
            <Form className="form p-2" onSubmit={onSubmit}>
                <input
                    type="search"
                    className="form-control form-control-sm"
                    placeholder="Filter..."
                    value={query}
                    onChange={onChange}
                />
            </Form>
            <div className="list-group list-group-flush border-bottom">
                {uniqueMessages(diagnostics).map(([{ message, severity }, count], i) => (
                    <ThreadInboxSidebarFilterListDiagnosticItem
                        key={i}
                        diagnostic={{ message, severity }}
                        count={count}
                        query={query}
                        className={ITEM_CLASS_NAME}
                    />
                ))}
                {uniqueFiles(diagnostics).map(([path, count], i) => (
                    <ThreadInboxSidebarFilterListPathItem
                        key={i}
                        path={path}
                        count={count}
                        query={query}
                        className={ITEM_CLASS_NAME}
                    />
                ))}
            </div>
        </aside>
    )
}

function uniqueMessages(diagnostics: DiagnosticInfo[]): [Pick<DiagnosticInfo, 'message' | 'severity'>, number][] {
    const messages = new Map<string, number>()
    const severity = new Map<string, DiagnosticSeverity>()
    for (const d of diagnostics) {
        const count = messages.get(d.message) || 0 // TODO!(sqs): hacky, doesnt support multi repos
        messages.set(d.message, count + 1)
        severity.set(d.message, d.severity)
    }
    return Array.from(messages.entries())
        .sort((a, b) => a[1] - b[1])
        .map(([message, count]) => [{ message, severity: severity.get(message)! }, count])
}

function uniqueFiles(diagnostics: DiagnosticInfo[]): [string, number][] {
    const files = new Map<string, number>()
    for (const d of diagnostics) {
        const count = files.get(d.entry.path) || 0 // TODO!(sqs): hacky, doesnt support multi repos
        files.set(d.entry.path, count + 1)
    }
    return Array.from(files.entries()).sort((a, b) => a[1] - b[1])
}
