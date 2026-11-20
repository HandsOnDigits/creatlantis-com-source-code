import AccountInformation from './AccountInformation'
import ChangePassword from './ChangePassword'

import { HorizontalHR } from '../../../Utilites'

function AccountSettings() {
  return (
    <section className="bg-background-blend space-y-6 p-4">
      <h2 className="big-text font-semibold">Account</h2>

      <HorizontalHR />

      <AccountInformation />

      <ChangePassword />
    </section>
  )
}

export default AccountSettings
