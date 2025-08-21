import Petregister from "@/rlclinic/petregistration";
import React, { Suspense } from 'react';

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Petregister/>
          
       </Suspense>
  );
}