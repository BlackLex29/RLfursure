import React,{ Suspense } from "react";
import Payment from "@/rlclinic/payment";

export default function Home() {
  return ( <Suspense fallback={<div>Loading...</div>}>
      
      <Payment/>
    
  </Suspense>
    );  
  }