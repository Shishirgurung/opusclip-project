import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to viral clips page immediately
    router.replace('/viral-clips');
  }, [router]);

  return null;
} 
