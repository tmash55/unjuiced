"use client"

import { Suspense } from "react"


import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import ArbsContent from "./arbs-content"

export const dynamic = 'force-dynamic'

function PositiveEvSkeleton() {
	return (
		<Card>
			<div className="p-4 space-y-4">
				<Skeleton className="h-8 w-[200px]" />
				<Skeleton className="h-[400px]" />
			</div>
		</Card>
	)
}

export default function PositiveEvPage() {
	return (
		<div className="w-full">
		

			{/* Dashboard Content */}
			<Suspense fallback={<PositiveEvSkeleton />}>
				<ArbsContent />
			</Suspense>
		</div>
	)
}