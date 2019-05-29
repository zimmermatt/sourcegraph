import React, { useEffect, useMemo, useState } from 'react'
import { Subscription } from 'rxjs'
import { catchError, startWith } from 'rxjs/operators'
import { ExtensionsControllerProps } from '../../../../../shared/src/extensions/controller'
import * as GQL from '../../../../../shared/src/graphql/schema'
import { asError, ErrorLike } from '../../../../../shared/src/util/errors'
import { parseJSON } from '../../../settings/configuration'
import { Changeset, computeChangesets } from '../../threads/detail/backend'

interface Props extends ExtensionsControllerProps {
    thread: GQL.IDiscussionThread
    repo: string

    tag?: 'td'
    className?: string
}

const LOADING: 'loading' = 'loading'

/**
 * A cell in the checks dashboard.
 */
export const CheckDashboardCell: React.FunctionComponent<Props> = ({
    thread,
    repo,
    tag: Tag = 'td',
    className = '',
    extensionsController,
}) => {
    const threadSettings = useMemo(() => parseJSON(thread.settings), [thread])

    const [changesetsOrError, setChangesetsOrError] = useState<typeof LOADING | Changeset[] | ErrorLike>(LOADING)
    // tslint:disable-next-line: no-floating-promises
    useEffect(() => {
        const subscriptions = new Subscription()
        subscriptions.add(
            computeChangesets(extensionsController, threadSettings, { repo })
                .pipe(
                    catchError(err => [asError(err)]),
                    startWith(LOADING)
                )
                .subscribe(setChangesetsOrError)
        )
        return () => subscriptions.unsubscribe()
    }, [thread.id, threadSettings, repo, extensionsController])

    return <Tag className={`${className} text-center`}>asdf</Tag>
}
