import * as React from 'react';
import { View } from 'react-native';

import { AdminNav, type SectionName } from '@/components/admin/nav';
import { FieldsSection } from '@/components/admin/fields-section';
import { PlacesSection } from '@/components/admin/places-section';
import { ReviewsSection, type ReviewFocus } from '@/components/admin/reviews-section';
import { TagsSection } from '@/components/admin/tags-section';
import { UsersSection } from '@/components/admin/users-section';

type AdminPanelProps = {
  email: string | null;
  onSignOut: () => void;
};

export function AdminPanel({ email, onSignOut }: AdminPanelProps) {
  const [section, setSection] = React.useState<SectionName>('users');
  /**
   * What Reviews was opened about, when it was opened by a link.
   *
   * The nonce rides alongside because the focus alone is not enough to detect a
   * second click: going from one user's posted count to another's changes the
   * object, but clicking the same one twice does not, and both have to re-apply.
   */
  const [focus, setFocus] = React.useState<ReviewFocus | null>(null);
  const [focusNonce, setFocusNonce] = React.useState(0);

  function showReviews(next: ReviewFocus | null) {
    setFocus(next);
    setFocusNonce((count) => count + 1);
    setSection('reviews');
  }

  function select(next: SectionName) {
    // Reaching Reviews from the nav means all reviews, not "still filtered by
    // whoever I last clicked through to". The nonce is deliberately NOT bumped:
    // clearing the focus is not a fresh question, so the filters you had set up
    // before wandering off are still yours.
    if (next === 'reviews') setFocus(null);
    setSection(next);
  }

  return (
    <View className="flex-1 flex-row bg-background">
      <AdminNav section={section} onSelect={select} email={email} onSignOut={onSignOut} />

      {/* Every section stays mounted and the inactive ones are hidden, so a trip
          to a user's reviews and back does not silently discard the filters,
          sort and page you had set up to find them.

          The cost of that is a section whose effect stopped running the moment
          the panel first rendered, which is how a tag made in Tags could be
          missing from the picker in Custom fields. So each one is told whether
          it is the one on screen and asks again when that turns true: state is
          kept, data is not. */}
      <View className="flex-1" style={section === 'users' ? undefined : { display: 'none' }}>
        <UsersSection
          visible={section === 'users'}
          onShowReviews={(user) =>
            showReviews({ kind: 'author', id: user.id, label: user.displayName })
          }
        />
      </View>
      <View className="flex-1" style={section === 'tags' ? undefined : { display: 'none' }}>
        <TagsSection visible={section === 'tags'} />
      </View>
      <View className="flex-1" style={section === 'reviews' ? undefined : { display: 'none' }}>
        <ReviewsSection
          focus={focus}
          focusNonce={focusNonce}
          onFocus={showReviews}
          onClearFocus={() => setFocus(null)}
          visible={section === 'reviews'}
        />
      </View>
      <View className="flex-1" style={section === 'fields' ? undefined : { display: 'none' }}>
        <FieldsSection visible={section === 'fields'} />
      </View>
      <View className="flex-1" style={section === 'places' ? undefined : { display: 'none' }}>
        <PlacesSection
          visible={section === 'places'}
          onShowReviews={(venue) =>
            showReviews({ kind: 'venue', id: venue.id, label: venue.name })
          }
        />
      </View>
    </View>
  );
}
