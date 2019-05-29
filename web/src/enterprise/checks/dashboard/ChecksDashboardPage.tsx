import { LoadingSpinner } from '@sourcegraph/react-loading-spinner'
import H from 'history'
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { RepoLink } from '../../../../../shared/src/components/RepoLink'
import { ExtensionsControllerProps } from '../../../../../shared/src/extensions/controller'
import * as GQL from '../../../../../shared/src/graphql/schema'
import { asError, ErrorLike, isErrorLike } from '../../../../../shared/src/util/errors'
import { fetchDiscussionThreads } from '../../../discussions/backend'
import { useEffectAsync } from '../../../util/useEffectAsync'
import { ChecksAreaTitle } from '../components/ChecksAreaTitle'
import { CheckDashboardCell } from './CheckDashboardCell'

interface Props extends ExtensionsControllerProps {
    location: H.Location
}

const REPOS = [
    'github.com/sourcegraph/sourcegraph',
    'github.com/sourcegraph/about',
    'github.com/sourcegraph/codeintellify',
    'github.com/sourcegraph/react-loading-spinner',
    'github.com/sourcegraph/sourcegraph',
    'github.com/lyft/pipelines',
    'github.com/lyft/amundsenfrontendlibrary',
]

const LOADING: 'loading' = 'loading'

/**
 * A dashboard for checks.
 */
export const ChecksDashboardPage: React.FunctionComponent<Props> = ({ location, ...props }) => {
    const [checksOrError, setChecksOrError] = useState<typeof LOADING | GQL.IDiscussionThreadConnection | ErrorLike>(
        LOADING
    )
    useEffectAsync(async () => {
        try {
            const checks = await fetchDiscussionThreads({}).toPromise()
            setChecksOrError(checks)
        } catch (err) {
            setChecksOrError(asError(err))
        }
    }, [])

    return (
        <div className="container-fluid mt-3">
            <ChecksAreaTitle />
            {checksOrError === LOADING ? (
                <LoadingSpinner className="mt-3 mx-auto" />
            ) : isErrorLike(checksOrError) ? (
                <div className="alert alert-danger">{checksOrError.message}</div>
            ) : (
                <table className="table table-bordered border-0 table-responsive-md">
                    <thead>
                        <tr>
                            <th className="border-top-0 border-left-0" />
                            {checksOrError.nodes.map((check, i) => (
                                <th key={i}>
                                    <Link to={check.url}>
                                        {check.title}{' '}
                                        <span className="font-weight-normal text-muted">#{check.idWithoutKind}</span>
                                    </Link>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {REPOS.map((repo, i) => (
                            <tr key={i}>
                                <th className="text-nowrap" style={{ width: '1%' }}>
                                    <RepoLink repoName={repo} to={`/${repo}`} />
                                </th>
                                {checksOrError.nodes.map((check, i) => (
                                    <CheckDashboardCell {...props} key={i} check={check} />
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}
