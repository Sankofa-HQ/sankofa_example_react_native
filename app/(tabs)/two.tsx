import { Redirect } from 'expo-router';

// The "two" tab from the default template is replaced by "replay".
// This redirect ensures any stale link doesn't 404.
export default function Two() {
  return <Redirect href="/(tabs)/replay" />;
}
