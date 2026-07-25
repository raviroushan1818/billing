import { useState } from 'react';
import { authApi } from '../../api';
import {
  Alert,
  Button,
  Field,
  PageHeader,
  useFormSubmit,
} from '../../components/ui';
import { KeyRound } from 'lucide-react';

export function AccountPage() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');

  const { busy, error, success, handle } = useFormSubmit(async () => {
    if (newPassword !== confirm) {
      throw new Error('New passwords do not match');
    }
    await authApi.changePassword(currentPassword, newPassword);
    setCurrent('');
    setNew('');
    setConfirm('');
  });

  return (
    <>
      <PageHeader
        icon={<KeyRound size={22} />}
        title="Account"
        subtitle="Change your login password"
      />
      <div className="panel" style={{ maxWidth: 480 }}>
        {error ? <Alert>{error}</Alert> : null}
        {success ? (
          <Alert variant="success">Password updated successfully</Alert>
        ) : null}
        <form className="form-stack" onSubmit={(e) => void handle(e)}>
          <Field label="Current password" htmlFor="cur">
            <input
              id="cur"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" htmlFor="np">
            <input
              id="np"
              type="password"
              value={newPassword}
              onChange={(e) => setNew(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password" htmlFor="cp">
            <input
              id="cp"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </div>
    </>
  );
}
