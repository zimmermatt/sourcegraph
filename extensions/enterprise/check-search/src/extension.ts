import * as sourcegraph from 'sourcegraph'
import { registerDemo0 as registerImportStarFixups } from './importStar'

export function activate(ctx: sourcegraph.ExtensionContext): void {
    ctx.subscriptions.add(registerImportStarFixups())
}
