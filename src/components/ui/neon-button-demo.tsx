
import { Button } from "@/components/ui/neon-button"

const Default = () => {
    return (
        <>
            <div className="flex flex-col gap-3">
                <Button>Default Orange</Button>
                <WithNoNeon />
                <Solid />
                <Secondary />
                <Teal />
            </div>
        </>
    )
}

const WithNoNeon = () => {
    return (
        <>
            <div className="flex flex-col gap-2">
                <Button neon={false}>Without Neon</Button>
            </div>
        </>
    )
}

const Solid = () => {
    return (
        <>
            <div className="flex flex-col gap-2">
                <Button variant={"solid"}>Solid Orange</Button>
            </div>
        </>
    )
}

const Secondary = () => {
    return (
        <>
            <div className="flex flex-col gap-2">
                <Button variant={"secondary"}>Secondary Blue</Button>
            </div>
        </>
    )
}

const Teal = () => {
    return (
        <>
            <div className="flex flex-col gap-2">
                <Button variant={"teal"}>Teal</Button>
            </div>
        </>
    )
}

export { Default, WithNoNeon, Solid, Secondary, Teal }
