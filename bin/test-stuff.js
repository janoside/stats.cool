let abc = " abc = 4 \nhaha=xyz";

let def = abc.split("\n").map(x => { return x.split("=").map(y => y.trim()) });

console.log("def=" + JSON.stringify(def));