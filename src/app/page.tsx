'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import styles from '@/app/styles/home.module.css';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/projects' : '/login');
  }, [user, loading, router]);

  return (
    <div className={styles.container}>
      <Loader2 className={styles.spinner} />
    </div>
  );
}
