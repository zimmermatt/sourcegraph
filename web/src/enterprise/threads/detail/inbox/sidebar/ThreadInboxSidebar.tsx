import React from 'react'
import { DiagnosticSeverity } from 'sourcegraph'
import { TreeFilterSidebar } from '../../../components/treeFilterSidebar/TreeFilterSidebar'
import { QueryParameterProps } from '../../../components/withQueryParameter/WithQueryParameter'
import { DiagnosticInfo } from '../../backend'
import { ThreadInboxSidebarFilterListDiagnosticItem } from './ThreadInboxSidebarFilterListDiagnosticItem'
import { ThreadInboxSidebarFilterListPathItem } from './ThreadInboxSidebarFilterListPathItem'

interface Props extends QueryParameterProps {
    diagnostics: DiagnosticInfo[]

    className?: string
}

/**
 * The sidebar for the thread inbox.
 */
export const ThreadInboxSidebar: React.FunctionComponent<Props> = ({ diagnostics, ...props }) => (
    <TreeFilterSidebar {...props}>
        {({ query, className }) => (
            <>
                {uniqueMessages(diagnostics).map(([{ message, severity }, count], i) => (
                    <ThreadInboxSidebarFilterListDiagnosticItem
                        key={i}
                        diagnostic={{ message, severity }}
                        count={count}
                        query={query}
                        className={className}
                    />
                ))}
                {uniqueFiles(diagnostics).map(([path, count], i) => (
                    <ThreadInboxSidebarFilterListPathItem
                        key={i}
                        path={path}
                        count={count}
                        query={query}
                        className={className}
                    />
                ))}
            </>
        )}
    </TreeFilterSidebar>
)

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
