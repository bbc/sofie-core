/**
 * Blueprint execution error codes for customizable error messages.
 *
 * In all cases the following string will be available in the translation context:
 * - error: Raw error message
 *
 * Some error codes provide additional context as documented below.
 */
export enum BlueprintErrorCode {
	/**
	 * Segment is missing required data
	 * Additional variables: segmentId, field (missing field name)
	 */
	MISSING_SEGMENT_DATA = 'BLUEPRINT_MISSING_SEGMENT_DATA',

	/**
	 * Invalid timing data in segment
	 * Additional variables: segmentId, reason
	 */
	INVALID_TIMING = 'BLUEPRINT_INVALID_TIMING',

	/**
	 * Failed to generate piece
	 * Additional variables: pieceId
	 */
	PIECE_GENERATION_FAILED = 'BLUEPRINT_PIECE_GENERATION_FAILED',

	/**
	 * Failed to generate part
	 * Additional variables: partId
	 */
	PART_GENERATION_FAILED = 'BLUEPRINT_PART_GENERATION_FAILED',

	/**
	 * Blueprint validation error
	 * Additional variables: reason
	 */
	VALIDATION_ERROR = 'BLUEPRINT_VALIDATION_ERROR',
}
