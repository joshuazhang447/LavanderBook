import * as React from 'react';
import { View } from 'react-native';

import { AdminNav, type SectionName } from '@/components/admin/nav';
import { FieldsSection } from '@/components/admin/fields-section';
import { PlacesSection } from '@/components/admin/places-section';
import { ReviewsSection } from '@/components/admin/reviews-section';
import { TagsSection } from '@/components/admin/tags-section';
import { UsersSection } from '@/components/admin/users-section';
import type { AdminUser } from '@/lib/admin';

type AdminPanelProps = {
  email: string | null;
  onSignOut: () => void;
};

export function AdminPanel({ email, onSignOut }: AdminPanelProps) {
  const [section, setSection] = React.useState<SectionName>('users');
  /** Set when Reviews is reached by clicking a user's posted count. */
  const [author, setAuthor] = React.useState<AdminUser | null>(null);

  function showReviewsFor(user: AdminUser) {
    setAuthor(user);
    setSection('reviews');
  }

  function select(next: SectionName) {
    // Reaching Reviews from the nav means all reviews, not "still filtered by
    // whoever I last clicked through to".
    if (next === 'reviews') setAuthor(null);
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
        <UsersSection visible={section === 'users'} onShowReviews={showReviewsFor} />
      </View>
      <View className="flex-1" style={section === 'tags' ? undefined : { display: 'none' }}>
        <TagsSection visible={section === 'tags'} />
      </View>
      <View className="flex-1" style={section === 'reviews' ? undefined : { display: 'none' }}>
        <ReviewsSection author={author} />
      </View>
      <View className="flex-1" style={section === 'fields' ? undefined : { display: 'none' }}>
        <FieldsSection visible={section === 'fields'} />
      </View>
      <View className="flex-1" style={section === 'places' ? undefined : { display: 'none' }}>
        <PlacesSection visible={section === 'places'} />
      </View>
    </View>
  );
}
