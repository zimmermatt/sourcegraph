import * as GQL from '../../../../shared/src/graphql/schema'

export type PullRequest = {
    repo: string
    label?: string
    items: GQL.ID[]
} & (
    | {
          status: 'pending'
          number: undefined
      }
    | {
          status: 'open' | 'merged' | 'closed'
          title: string
          number: number
          commentsCount: number
          updatedAt: string
          updatedBy: string
      })

export interface ThreadSettings {
    providers?: string[]
    queries?: string[]
    pullRequests?: PullRequest[]
    pullRequestTemplate?: {
        title?: string
        branch?: string
        description?: string
    }
    actions?: { [id: string]: string | undefined }
}
