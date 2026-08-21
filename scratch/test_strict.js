// test_strict.js
Object.defineProperty(global, 'myGlobalVar', {
    get() { return global._myGlobalVarValue || 'default'; },
    set(val) { global._myGlobalVarValue = val; },
    configurable: true,
    enumerable: true
});

function test() {
    console.log("Initial:", myGlobalVar);
    myGlobalVar = "new value";
    console.log("After write:", myGlobalVar);
    console.log("global._myGlobalVarValue:", global._myGlobalVarValue);
}

test();
