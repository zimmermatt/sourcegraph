import React from 'react'
import { ExtensionsControllerProps } from '../../../../../shared/src/extensions/controller'
import * as GQL from '../../../../../shared/src/graphql/schema'

interface Props extends ExtensionsControllerProps {
    check: GQL.IDiscussionThread

    tag?: 'td'
    className?: string
}

/**
 * A cell in the checks dashboard.
 */
export const CheckDashboardCell: React.FunctionComponent<Props> = ({ tag: Tag = 'td', className = '' }) => {
    const a = 3
    return 'h'
}
