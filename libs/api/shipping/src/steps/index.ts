// quickpickle reads step definitions from setupFiles; this loads every *.steps.ts of the lib.
import.meta.glob(['./*.steps.ts', '../*/steps/*.steps.ts'], { eager: true });
