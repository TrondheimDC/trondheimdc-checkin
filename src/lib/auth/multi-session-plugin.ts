import { createAuthPlugin } from "@better-auth-ui/core"
import {
  multiSessionPlugin as coreMultiSessionPlugin,
  type MultiSessionPluginOptions,
} from "@better-auth-ui/core/plugins/multi-session"

import { SwitchAccountItems } from "@/components/auth/multi-session/switch-account-items"

export const multiSessionPlugin = createAuthPlugin(
  coreMultiSessionPlugin.id,
  (options: MultiSessionPluginOptions = {}) => ({
    ...coreMultiSessionPlugin(options),
    userMenuItems: [SwitchAccountItems],
  }),
)
