import React, { useMemo, useState } from 'react'

/**
 * pretty-prints JSON content, and collapses it if it's too long.
 */
export function CollapseJSON({ json }: { json: string }): JSX.Element {
	const [expanded, setExpanded] = useState(false)

	const originalString = useMemo(() => {
		try {
			const obj = JSON.parse(json)
			let str = JSON.stringify(obj, undefined, 2) // Pretty print JSON

			// If the JSON string is a pretty short one, use a condensed JSON instead:
			if (str.length < 200) {
				str = JSON.stringify(obj) // Condensed JSON
			}
			return str
		} catch (_e) {
			// Ignore parsing error
			return '' + json
		}
	}, [json])

	/** Position of the 5th line in the string, 0 if not found */
	const indexOf5thLine = useMemo(() => {
		let indexOf5thLine: null | number = null
		let foundIndex = 0
		for (let foundCount = 0; foundCount < 10; foundCount++) {
			foundIndex = originalString.indexOf('\n', foundIndex + 1)
			if (foundIndex === -1) {
				break
			} else {
				if (foundCount >= 5) {
					indexOf5thLine = foundIndex
					break
				}
			}
		}
		return indexOf5thLine
	}, [originalString])

	if (originalString.length < 100 && indexOf5thLine === null) {
		return <pre>{originalString}</pre>
	}

	const displayContents = expanded ? (
		<>
			{originalString}
			<button
				key={'collapse'}
				className="collapse-json__collapser"
				tabIndex={0}
				onClick={(e) => {
					e.stopPropagation()
					setExpanded(false)
				}}
			>
				⮥
			</button>
		</>
	) : (
		<>
			{originalString.substring(0, Math.min(indexOf5thLine || 100, 100))}
			<button
				key={'expand'}
				className="collapse-json__collapser"
				tabIndex={0}
				onClick={(e) => {
					e.stopPropagation()
					setExpanded(true)
				}}
			>
				…
			</button>
		</>
	)

	return (
		<pre tabIndex={0} onClick={() => setExpanded(!expanded)} className="collapse-json__block">
			{displayContents}
		</pre>
	)
}
