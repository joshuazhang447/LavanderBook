import { vars } from 'nativewind';
import * as React from 'react';
import { Platform, View } from 'react-native';

import { useSkin } from '@/lib/skin';
import { oauTabVariables, oauTintClass, type OauTab } from '@/lib/theme';

/**
 * OAU gives each tab one colour of the trans flag: the Map is blue, the
 * Directory white, My Account pink (LavenderBookStyle/oau-style-guide.md,
 * section 4.8). The skin's own palette is the Map's; this puts a tab's colours
 * over it for everything inside the tab.
 *
 * On a phone the variables are set on this view. A view that starts setting
 * variables after its first render is remounted (skin-provider.tsx), so it sets
 * one in every skin - only OAU's colours are left out of the others. On the
 * website it is a class, which the skins' stylesheet colours under OAU only.
 *
 * Not yet carried into sheets and menus: they render at the portal host,
 * outside the tab (the guide's implementation plan, step 0.5).
 */

const TabContext = React.createContext<OauTab>('map');

/** Which tab's colours are around: the Map's outside any TabTint. */
export function useOauTab(): OauTab {
  return React.useContext(TabContext);
}

/** Built once: a new vars() object every render would restyle the whole tab. */
const TINTED: Record<OauTab, object> = {
  map: vars({ '--oau-tab': 'map', ...oauTabVariables('map') }),
  directory: vars({
    '--oau-tab': 'directory',
    ...oauTabVariables('directory'),
  }),
  account: vars({ '--oau-tab': 'account', ...oauTabVariables('account') }),
};

const PLAIN: Record<OauTab, object> = {
  map: vars({ '--oau-tab': 'map' }),
  directory: vars({ '--oau-tab': 'directory' }),
  account: vars({ '--oau-tab': 'account' }),
};

export function TabTint({ tab, children }: React.PropsWithChildren<{ tab: OauTab }>) {
  const { skin } = useSkin();

  return (
    <TabContext.Provider value={tab}>
      {Platform.OS === 'web' ? (
        <View className={`flex-1 ${oauTintClass(tab)}`}>{children}</View>
      ) : (
        <View className="flex-1" style={skin === 'oau' ? TINTED[tab] : PLAIN[tab]}>
          {children}
        </View>
      )}
    </TabContext.Provider>
  );
}
