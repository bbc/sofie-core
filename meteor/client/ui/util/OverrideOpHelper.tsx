import { SomeObjectOverrideOp, ObjectWithOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { useRef, useMemo, useEffect } from 'react'
import { OverrideOpHelper, OverrideOpHelperImpl } from '@sofie-automation/corelib/dist/overrideOpHelper'

export * from '@sofie-automation/corelib/dist/overrideOpHelper'

/**
 * A helper to work with modifying an ObjectWithOverrides<T>
 */
export function useOverrideOpHelper<T extends object>(
	saveOverrides: (newOps: SomeObjectOverrideOp[]) => void,
	objectWithOverrides: ObjectWithOverrides<T>
): OverrideOpHelper {
	const objectWithOverridesRef = useRef(objectWithOverrides)

	const helper = useMemo(
		() => new OverrideOpHelperImpl(saveOverrides, objectWithOverridesRef),
		[saveOverrides, objectWithOverridesRef]
	)

	// Use a ref to minimise reactivity when it changes
	useEffect(() => {
		objectWithOverridesRef.current = objectWithOverrides
	}, [objectWithOverrides])

	return helper
}
