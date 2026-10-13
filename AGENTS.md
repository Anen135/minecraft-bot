# Development Guidelines

## One-line functions

Extract an expression into a one-line function only when there is a concrete reason to expect that logic to change as the project develops. Do not create functions just to give an expression a name: clear code often explains itself. If there is no such reason, keep the expression at its call site; a hypothetical future change is not enough.
