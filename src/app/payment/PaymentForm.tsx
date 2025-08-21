import React,{ Suspense } from "react";
import PaymentForm from "@/rlclinic/payment";

export default function PaymentPage() {
  return ( <Suspense fallback={<div>Loading...</div>}>
      <PaymentForm />
    </Suspense>
  );  
}