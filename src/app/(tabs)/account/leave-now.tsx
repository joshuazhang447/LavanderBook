import { Redirect } from 'expo-router';

import { LeaveNowSettingPage } from '@/components/chenfeng/setting-pages';
import { useSkin } from '@/lib/skin';

/** Chenfeng's page for this setting. The other skins keep theirs on the Account tab. */
export default function Page() {
  const { skin } = useSkin();
  if (skin !== 'chenfeng') return <Redirect href="/account" />;
  return <LeaveNowSettingPage />;
}
