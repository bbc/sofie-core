import { PartInstanceId, PieceInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PropsWithChildren, useRef, useState } from 'react'
import { dragContext } from './DragContext'
import { PieceUi } from '../SegmentContainer/withResolvedSegment'
import { doUserAction, UserAction } from '../../lib/clientUserAction'
import { MeteorCall } from '../../lib/meteorApi'
import { TFunction } from 'i18next'
import { UIParts } from '../Collections'
import { Segments } from '../../collections'

const DRAG_TIMEOUT = 10000

interface Props {
	t: TFunction
}

// notes: this doesn't limit dragging between rundowns right now but I'm not sure if the ingest stage will be happy with that - mint
export function DragContextProvider({ t, children }: PropsWithChildren<Props>): JSX.Element {
	const [pieceId, setPieceId] = useState<undefined | PieceInstanceId>(undefined)
	const [piece, setPiece] = useState<undefined | PieceUi>(undefined)

	const partIdRef = useRef<undefined | PartInstanceId>(undefined)
	const positionRef = useRef({ x: 0, y: 0 })
	const segmentIdRef = useRef<undefined | SegmentId>(undefined)

	const startDrag = (
		ogPiece: PieceUi,
		timeScale: number,
		pos: { x: number; y: number },
		elementOffset?: number,
		limitToSegment?: SegmentId
	) => {
		if (pieceId) return // a drag is currently in progress....

		const inPoint = ogPiece.renderedInPoint ?? 0
		segmentIdRef.current = limitToSegment
		positionRef.current = pos
		setPieceId(ogPiece.instance._id)

		let localPiece = ogPiece // keep a copy of the overriden piece because react does not let us access the state of the context easily

		const onMove = (e: MouseEvent) => {
			const newInPoint =
				(!partIdRef.current ? inPoint : (elementOffset ?? 0) / timeScale) +
				(e.clientX - positionRef.current.x) / timeScale

			localPiece = {
				...ogPiece,
				instance: { ...ogPiece.instance, partInstanceId: partIdRef.current ?? ogPiece.instance.partInstanceId },
				renderedInPoint: newInPoint,
			}
			setPiece(localPiece)
		}

		const cleanup = () => {
			// unset state - note: for ux reasons this runs after the backend operation has returned a result
			setPieceId(undefined)
			setPiece(undefined)
			partIdRef.current = undefined
			segmentIdRef.current = undefined
		}

		const onMouseUp = (e: MouseEvent) => {
			// detach from the mouse
			document.removeEventListener('mousemove', onMove)
			document.removeEventListener('mouseup', onMouseUp)

			// process the drag
			if (!localPiece) return cleanup()

			// find the new part so we can get it's externalId
			const startPartId = localPiece.instance.piece.startPartId // this could become a funny thing with infinites
			const part = UIParts.findOne(startPartId)
			if (!part) return cleanup() // tough to continue without a parent for the piece

			// find the new Segment's External ID
			const segment = Segments.findOne(part?.segmentId)

			// note - should we be nice and look up the segment and part as well?
			// if we do, should we put the old part/segment here or the new one?
			// probably old - we target the piece (which is in the old part) and move it to the new part
			const operationTarget = {
				segmentExternalId: undefined,
				partExternalId: undefined,
				pieceExternalId: ogPiece.instance.piece.externalId,
			}
			doUserAction(
				t,
				e,
				UserAction.EXECUTE_USER_OPERATION,
				(e, ts) =>
					MeteorCall.userAction.executeUserChangeOperation(e, ts, part.rundownId, operationTarget, {
						id: '__sofie-retime-piece',
						payload: {
							segmentExternalId: segment?.externalId,
							partExternalId: part.externalId,

							inPoint: localPiece.renderedInPoint,
						},
					}),
				() => {
					cleanup()
				}
			)
		}

		document.addEventListener('mousemove', onMove)
		document.addEventListener('mouseup', onMouseUp)

		setTimeout(() => {
			// after the timeout we want to bail out in case something went wrong
			document.removeEventListener('mousemove', onMove)
			document.removeEventListener('mouseup', onMouseUp)

			cleanup()
		}, DRAG_TIMEOUT)
	}
	const setHoveredPart = (updatedPartId: PartInstanceId, segmentId: SegmentId, pos: { x: number; y: number }) => {
		if (!pieceId) return
		if (updatedPartId === piece?.instance.partInstanceId) return
		if (segmentIdRef.current && segmentIdRef.current !== segmentId) return

		partIdRef.current = updatedPartId
		positionRef.current = pos
	}

	const ctx = {
		pieceId,
		piece,

		startDrag,
		setHoveredPart,
	}

	return <dragContext.Provider value={ctx}>{children}</dragContext.Provider>
}
