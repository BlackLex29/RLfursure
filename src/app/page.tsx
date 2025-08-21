"use client";

import  { useEffect } from 'react';
import { useRouter } from 'next/navigation';



export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/register'); // mag-redirect sa /register
  }, [router]);

  return null; // walang UI, redirect lang
}