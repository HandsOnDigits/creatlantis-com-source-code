import AccountInformation from './AccountInformation'
import ChangePassword from './ChangePassword'

function AccountSettings() {
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Account</h2>

      <AccountInformation />

      <ChangePassword />
    </section>
  )
}

export default AccountSettings
